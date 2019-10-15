import { Application } from 'probot';
import * as j from './client';
export declare const setup: (app: Application) => void;
export declare function credentials(owner: string, repo: string): Promise<j.Credentials>;
