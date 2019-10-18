FROM node:10

ENV PATH=$PATH:/app/node_modules/.bin
WORKDIR /app
COPY . .
RUN npm install --production && echo "JIRA domain: $INPUT_JIRA_DOMAIN"

ENV GH_USER="github-actions"
ENTRYPOINT ["probot", "receive"]
CMD ["/app/lib/index.js"]
