export interface CommandResult {
    success: boolean;
    stdout: string;
    stderr: string;
    data?: any;
}
export declare class PosCliGatewayAdapter {
    private binDir;
    constructor(cwd?: string);
    exec(command: string, args?: string[], options?: any): Promise<CommandResult>;
}
//# sourceMappingURL=gatewayAdapter.d.ts.map