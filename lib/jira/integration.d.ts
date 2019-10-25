import { GitHubAPI } from 'probot/lib/github';
import { LoggerWithTarget } from 'probot/lib/wrap-logger';
import * as j from './client';
declare type InstallRepo = {
    owner: string;
    repo: string;
};
declare type EventContext = {
    repo: InstallRepo;
    github: GitHubAPI;
    log: LoggerWithTarget;
    githubDispatchBaseUrl: string;
};
export declare function ensureHook(ctx: EventContext): Promise<InstallRepo>;
export declare function credentials(owner: string, repo: string): Promise<j.Credentials>;
export {};
