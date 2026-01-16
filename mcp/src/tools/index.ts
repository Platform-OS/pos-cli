import type { Tool } from './env.tools';
import { environmentTools } from './env.tools';
import { graphqlTools } from './graphql.tools';
import { dataTools } from './data.tools';
import { modulesTools } from './modules.tools';
import { logsTools } from './logs.tools';
import { constantsTools } from './constants.tools';
import { liquidTools } from './liquid.tools';
import { migrationsTools } from './migrations.tools';

export { Tool };

export const allTools: Tool[] = [
  ...environmentTools,
  ...graphqlTools,
  ...dataTools,
  ...modulesTools,
  ...logsTools,
  ...constantsTools,
  ...liquidTools,
  ...migrationsTools,
];