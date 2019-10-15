import * as t from 'io-ts';
export declare const Issue: t.ExactC<t.TypeC<{
    id: t.StringC;
    key: t.StringC;
    fields: t.ExactC<t.TypeC<{
        fixVersions: t.ArrayC<t.ExactC<t.TypeC<{
            id: t.StringC;
            description: t.UnionC<[t.StringC, t.UndefinedC, t.NullC]>;
            name: t.StringC;
        }>>>;
        resolution: t.UnionC<[t.ExactC<t.TypeC<{
            name: t.StringC;
        }>>, t.UndefinedC, t.NullC]>;
        status: t.ExactC<t.TypeC<{
            name: t.StringC;
        }>>;
        summary: t.StringC;
        description: t.UnionC<[t.StringC, t.UndefinedC, t.NullC]>;
    }>>;
}>>;
export declare type IIssue = t.TypeOf<typeof Issue>;
export declare const HookSettings: t.ExactC<t.TypeC<{
    name: t.StringC;
    url: t.StringC;
    enabled: t.BooleanC;
    events: t.ArrayC<t.StringC>;
    filters: t.UnionC<[t.ExactC<t.TypeC<{
        'issue-related-events-section': t.UnionC<[t.StringC, t.UndefinedC]>;
    }>>, t.UndefinedC, t.NullC]>;
}>>;
export declare type IHookSettings = t.TypeOf<typeof HookSettings>;
export declare const Hook: t.ExactC<t.IntersectionC<[t.TypeC<{
    name: t.StringC;
    url: t.StringC;
    enabled: t.BooleanC;
    events: t.ArrayC<t.StringC>;
    filters: t.UnionC<[t.ExactC<t.TypeC<{
        'issue-related-events-section': t.UnionC<[t.StringC, t.UndefinedC]>;
    }>>, t.UndefinedC, t.NullC]>;
}>, t.TypeC<{
    self: t.StringC;
}>]>>;
export declare type IHook = t.TypeOf<typeof Hook>;
export declare const Callback: t.ExactC<t.TypeC<{
    payload: t.ExactC<t.TypeC<{
        timestamp: t.NumberC;
        webhookEvent: t.StringC;
        user: t.ExactC<t.TypeC<{
            name: t.StringC;
            key: t.StringC;
            displayName: t.StringC;
            emailAddress: t.StringC;
            self: t.StringC;
        }>>;
    }>>;
}>>;
export declare type ICallback = t.TypeOf<typeof Callback>;
export declare const IssueCallback: t.ExactC<t.TypeC<{
    payload: t.ExactC<t.IntersectionC<[t.TypeC<{
        timestamp: t.NumberC;
        webhookEvent: t.StringC;
        user: t.ExactC<t.TypeC<{
            name: t.StringC;
            key: t.StringC;
            displayName: t.StringC;
            emailAddress: t.StringC;
            self: t.StringC;
        }>>;
    }>, t.TypeC<{
        issue: t.ExactC<t.TypeC<{
            id: t.StringC;
            key: t.StringC;
            fields: t.ExactC<t.TypeC<{
                fixVersions: t.ArrayC<t.ExactC<t.TypeC<{
                    id: t.StringC;
                    description: t.UnionC<[t.StringC, t.UndefinedC, t.NullC]>;
                    name: t.StringC;
                }>>>;
                resolution: t.UnionC<[t.ExactC<t.TypeC<{
                    name: t.StringC;
                }>>, t.UndefinedC, t.NullC]>;
                status: t.ExactC<t.TypeC<{
                    name: t.StringC;
                }>>;
                summary: t.StringC;
                description: t.UnionC<[t.StringC, t.UndefinedC, t.NullC]>;
            }>>;
        }>>;
    }>]>>;
}>>;
export declare type IIssueCallback = t.TypeOf<typeof IssueCallback>;
