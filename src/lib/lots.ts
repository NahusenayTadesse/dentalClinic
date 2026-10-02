/**
 * How far ahead a stock lot counts as expiring. Three months is the window to use a box up, move it
 * to the busier chair, or ask the supplier to swap it, before it has to be written off. Shared by
 * the item's lot list and the dashboard's warning, so both call the same box "expiring".
 *
 * The expiry rules themselves (`expiryState`) are the admin-kit's; this window is the clinic's.
 */
export const LOT_WARNING_DAYS = 90;
