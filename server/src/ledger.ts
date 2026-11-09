import { readFileSync } from "node:fs";
import { isIsoDate } from "./dates";
import { parseMoney, ZERO, type Money } from "./money";

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_SUBTYPES = [
  "operating_revenue",
  "contra_revenue",
  "cogs",
  "operating_expense",
  "other_income",
  "balance_sheet",
] as const;
export type AccountSubtype = (typeof ACCOUNT_SUBTYPES)[number];

/** Which account types each subtype may hold. Catches e.g. an asset filed under cogs. */
const TYPES_FOR_SUBTYPE: Record<AccountSubtype, readonly AccountType[]> = {
  operating_revenue: ["revenue"],
  contra_revenue: ["revenue"],
  cogs: ["expense"],
  operating_expense: ["expense"],
  other_income: ["revenue", "expense"],
  balance_sheet: ["asset", "liability", "equity"],
};

export const ENTRY_STATUSES = ["posted", "draft", "void"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export interface Account {
  number: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  isActive: boolean;
}

export interface JournalLine {
  account: string;
  debit: Money;
  credit: Money;
}

export interface JournalEntry {
  id: string;
  date: string;
  status: EntryStatus;
  memo: string;
  lines: JournalLine[];
}

export interface Ledger {
  company: string;
  currency: string;
  /** Keyed by account number, in chart-of-accounts order. */
  accounts: Map<string, Account>;
  entries: JournalEntry[];
}

interface RawLedger {
  company: string;
  currency: string;
  accounts: RawAccount[];
  journal_entries: RawEntry[];
}

interface RawAccount {
  number: string;
  name: string;
  type: string;
  subtype: string;
  is_active: boolean;
}

interface RawEntry {
  id: string;
  date: string;
  status: string;
  memo: string;
  lines: RawLine[];
}

interface RawLine {
  account: string;
  debit: string;
  credit: string;
}

export class LedgerError extends Error {
  override name = "LedgerError";
}

/**
 * Parses raw ledger JSON into domain types and validates it. Throws LedgerError naming
 * the offending account or entry id on the first problem found. Draft and void entries
 * are validated too: they stay in the ledger, so bad data in them is still bad data.
 */
export function loadLedger(raw: unknown): Ledger {
  const data = raw as RawLedger;
  if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.journal_entries)) {
    throw new LedgerError("ledger must have accounts and journal_entries arrays");
  }

  const accounts = new Map<string, Account>();
  for (const rawAccount of data.accounts) {
    const account = toAccount(rawAccount);
    if (accounts.has(account.number)) {
      throw new LedgerError(`duplicate account number ${account.number}`);
    }
    accounts.set(account.number, account);
  }

  const seenIds = new Set<string>();
  const entries = data.journal_entries.map((rawEntry) => {
    if (seenIds.has(rawEntry.id)) throw new LedgerError(`duplicate entry id ${rawEntry.id}`);
    seenIds.add(rawEntry.id);
    return toEntry(rawEntry, accounts);
  });

  return { company: data.company, currency: data.currency, accounts, entries };
}

function toAccount(raw: RawAccount): Account {
  const where = `account ${raw.number}`;
  if (!isOneOf(ACCOUNT_TYPES, raw.type)) throw new LedgerError(`${where}: unknown type ${JSON.stringify(raw.type)}`);
  if (!isOneOf(ACCOUNT_SUBTYPES, raw.subtype)) {
    throw new LedgerError(`${where}: unknown subtype ${JSON.stringify(raw.subtype)}`);
  }
  if (!TYPES_FOR_SUBTYPE[raw.subtype].includes(raw.type)) {
    throw new LedgerError(`${where}: type ${raw.type} cannot have subtype ${raw.subtype}`);
  }
  return { number: raw.number, name: raw.name, type: raw.type, subtype: raw.subtype, isActive: raw.is_active };
}

function toEntry(raw: RawEntry, accounts: Map<string, Account>): JournalEntry {
  const where = `entry ${raw.id}`;
  if (!isOneOf(ENTRY_STATUSES, raw.status)) throw new LedgerError(`${where}: unknown status ${JSON.stringify(raw.status)}`);
  if (!isIsoDate(raw.date)) throw new LedgerError(`${where}: invalid date ${JSON.stringify(raw.date)}, expected YYYY-MM-DD`);
  if (!Array.isArray(raw.lines) || raw.lines.length < 2) throw new LedgerError(`${where}: needs at least two lines`);

  const lines = raw.lines.map((line, i) => toLine(line, `${where} line ${i + 1}`, accounts));

  const debits = lines.reduce((sum, l) => sum + l.debit, ZERO);
  const credits = lines.reduce((sum, l) => sum + l.credit, ZERO);
  if (debits !== credits) throw new LedgerError(`${where}: debits do not equal credits`);

  return { id: raw.id, date: raw.date, status: raw.status, memo: raw.memo, lines };
}

function toLine(raw: RawLine, where: string, accounts: Map<string, Account>): JournalLine {
  if (!accounts.has(raw.account)) throw new LedgerError(`${where}: unknown account ${JSON.stringify(raw.account)}`);
  const debit = toMoney(raw.debit, where);
  const credit = toMoney(raw.credit, where);
  if ((debit === ZERO) === (credit === ZERO)) {
    throw new LedgerError(`${where}: exactly one of debit or credit must be non-zero`);
  }
  return { account: raw.account, debit, credit };
}

function toMoney(text: string, where: string): Money {
  try {
    return parseMoney(text);
  } catch (err) {
    throw new LedgerError(`${where}: ${(err as Error).message}`);
  }
}

function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return (allowed as readonly unknown[]).includes(value);
}

export function readLedgerFile(path: string | URL): Ledger {
  return loadLedger(JSON.parse(readFileSync(path, "utf8")));
}
