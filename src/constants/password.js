/**
 * The minimum the server enforces, repeated here so a form can say so.
 *
 * Mirrors shared/src/passwordPolicy.js, which is the authority. The admin
 * create-user forms sent whatever was typed and showed nothing when the server
 * refused it, so a seven-character password produced a modal that simply did
 * not close — the commonest way "I cannot create an employee" was reached.
 */
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters.`;
