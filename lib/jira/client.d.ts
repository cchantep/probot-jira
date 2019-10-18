import { Option } from 'fp-ts/lib/Option';
import { Either } from 'fp-ts/lib/Either';
import { IHook, IHookSettings, IIssue } from '../model/jira';
export declare type Credentials = {
    domain: string;
    username: string;
    apiToken: string;
};
export declare function getIssue(credentials: Credentials, key: string): Promise<Option<IIssue>>;
export declare function getHooks(credentials: Credentials): Promise<ReadonlyArray<IHook>>;
export declare function getHook(credentials: Credentials, id: string): Promise<Option<IHook>>;
export declare function registerHook(credentials: Credentials, hook: IHookSettings): Promise<Either<string, void>>;
