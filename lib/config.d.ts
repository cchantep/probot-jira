import { Context } from 'probot';
import * as t from 'io-ts';
import { RepoRef } from './model/pullrequest';
export declare const Config: t.ExactC<t.TypeC<{
    issueKeyRegex: t.StringC;
    milestoneRegex: t.UnionC<[t.StringC, t.UndefinedC]>;
    fixVersionRegex: t.StringC;
    postMergeStatus: t.ArrayC<t.StringC>;
    githubDispatchBaseUrl: t.UnionC<[t.StringC, t.UndefinedC]>;
}>>;
export declare type IConfig = t.TypeOf<typeof Config>;
export declare const DefaultConfig: IConfig;
export declare function getConfig(bot: Context, repo: RepoRef, ref: string): Promise<IConfig>;
