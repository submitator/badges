// Every brand string of the package lives here, so a neutral build swaps one file.

/** The npm package name, used in log lines. */
export const PACKAGE_NAME = "@submitator/badges";

/** The product token of the User-Agent the package sends. */
export const UA_PRODUCT = "submitator-badges";

/** The page that explains what the package does; the User-Agent links to it. */
export const DOCS_URL = "https://submitator.com/badge-package";

/** Where the package fetches walls unless `apiUrl` says otherwise. */
export const DEFAULT_API_URL = "https://api.submitator.com";

/** The prefix of every line the package logs. */
export const LOG_PREFIX: string = `[${PACKAGE_NAME}]`;

/** A request Next.js caches like any other, so a page served from memory keeps a lifetime. */
export const LIFETIME_MARK_URL = "data:text/plain,submitator-wall";
