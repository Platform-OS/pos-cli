// purpose:		what the token the GUI was started with may do on this instance
// arguments:	/info as stored in $state.online (object), the scope a feature needs (string)
// returns:		true when the token's scopes cover it; a token with no scopes has full access
// ------------------------------------------------------------------------
// The GUI only hides what would be refused -- the instance enforces the scopes and
// refuses the rest -- so an unknown answer reads as allowed. The matching rule is the one
// pos-cli, the Partner Portal and the instance share; it is dependency-free, so vite
// bundles it into this app.
import { permits } from '../../../../lib/utils/tokenScopes.js';

const can = (online, scope) => permits(online?.scopes ?? null, scope);

// whether the token is limited at all, for the header badge
const limited = (online) => Array.isArray(online?.scopes) && !online.scopes.includes('*');

export { can, limited };
