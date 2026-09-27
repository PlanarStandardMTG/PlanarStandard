/**
 * What an admin types to confirm sending every finished tournament round the
 * fetch queue again. Shared by the dialog that asks and the action that checks,
 * which cannot export it: a `"use server"` file exports async functions only.
 */
export const REFETCH_CONFIRMATION = "refetch";
