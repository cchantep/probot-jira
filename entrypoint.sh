#! /bin/sh

export GH_USER="github-actions"

if [ "x$JIRA_DOMAIN" = "x" -a "x$INPUT_JIRA_DOMAIN" != "x" ]; then
    export JIRA_DOMAIN="$INPUT_JIRA_DOMAIN"
fi

if [ "x$JIRA_USER" = "x" -a "x$INPUT_JIRA_USER" != "x" ]; then
    export JIRA_USER="$INPUT_JIRA_USER"
fi

if [ "x$JIRA_PROJECT_NAME" = "x" -a "x$INPUT_JIRA_PROJECT_NAME" != "x" ]; then
    export JIRA_PROJECT_NAME="$INPUT_JIRA_PROJECT_NAME"
fi

probot receive /app/lib/index.js
