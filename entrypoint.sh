#! /bin/sh

if [ "x$JIRA_DOMAIN" = "x" -a "x$INPUT_JIRA_DOMAIN" != "x" ]; then
    export JIRA_DOMAIN="$INPUT_JIRA_DOMAIN"
fi

if [ "x$JIRA_USER" = "x" -a "x$INPUT_JIRA_USER" != "x" ]; then
    export JIRA_USER="$INPUT_JIRA_USER"
fi

if [ "x$JIRA_PROJECT_NAME" = "x" -a "x$INPUT_JIRA_PROJECT_NAME" != "x" ]; then
    export JIRA_PROJECT_NAME="$INPUT_JIRA_PROJECT_NAME"
fi

if [ "x$PERSONAL_TOKEN_USER" = "x" -a "x$INPUT_PERSONAL_TOKEN_USER" != "x" ]; then
    export PERSONAL_TOKEN_USER="$INPUT_PERSONAL_TOKEN_USER"
fi

if [ "x$PERSONAL_TOKEN_VALUE" = "x" -a "x$INPUT_PERSONAL_TOKEN_VALUE" != "x" ]; then
    export PERSONAL_TOKEN_VALUE="$INPUT_PERSONAL_TOKEN_VALUE"
fi

probot receive /app/lib/index.js
