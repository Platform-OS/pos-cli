export interface GraphQLResult {
    data?: any;
    errors?: Array<{
        message: string;
        locations?: any[];
    }>;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    errors?: any[];
}
export declare class PlatformOSClient {
    getGateway(envName: string): Promise<any>;
    graphql(env: string, query: string, variables?: Record<string, any>): Promise<ApiResponse<GraphQLResult>>;
    liquidRender(env: string, template: string, locals?: Record<string, any>): Promise<ApiResponse<string>>;
    listModules(env: string): Promise<ApiResponse<any[]>>;
    dataExportStart(env: string, export_internal?: boolean, csv_export?: boolean): Promise<ApiResponse<{
        id: string;
    }>>;
    dataExportStatus(env: string, id: string, csv_export?: boolean): Promise<ApiResponse<any>>;
    listMigrations(env: string): Promise<ApiResponse<any>>;
    runMigration(env: string, version: string): Promise<ApiResponse<any>>;
}
export declare const client: PlatformOSClient;
//# sourceMappingURL=apiWrappers.d.ts.map