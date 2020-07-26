package main

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
)

func main() {
	port := os.Getenv("PORT")

	log.Printf("Starting on port %s", port)

	http.HandleFunc("/jira/", jira)

	log.Fatal(http.ListenAndServe(":"+port, nil))
}

// --- JIRA

type JiraIssueCallbackPayload struct {
	Timestamp    int64
	WebhookEvent string
	Issue        JiraIssueCallbackRef
}

type JiraIssueCallbackRef struct {
	Id string
}

// HTTP Handler for POST with request of following form:
//
//   /<something>/$githubOwner_org_or_user/$githubRepo
//
// The parameters 'user' and 'pass' are also expected in the query string,
// respectively for a GitHub user and its associated token
// (plain password not recommanded: https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line ).
//
// A JSON payload is expected as request body:
//
// {
//   "payload": {
//     "timestamp": 1234567890,
//     "webhookEvent": "jira:issue_updated",
//     "issue": {
//       "self": "https://foo.atlassian.net/rest/api/2/issue/12345",
//     }
//   }
// }
func jira(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, fmt.Sprintf("Unexpected method: %s", r.Method), 400)
		return
	}

	uri := r.URL.Path

	components := strings.Split(uri, "/")

	log.Printf("Dispatching %s ...", uri)

	values, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		http.Error(w, fmt.Sprintf("Fails to parse query string: %s", err.Error()), 400)

		return
	}

	body, err := ioutil.ReadAll(r.Body)

	if err != nil {
		http.Error(w, fmt.Sprintf("Fails to read request body: %s", err.Error()), 400)

		return
	}

	//log.Printf("JIRA payload: %s", body)

	var issue JiraIssueCallbackPayload
	err = json.Unmarshal(body, &issue)

	if err != nil {
		http.Error(w, fmt.Sprintf("Fails to parse JSON body: %s", err.Error()), 400)

		return
	}

	ghApiUrl := fmt.Sprintf("https://api.github.com/repos/%s/dispatches", strings.Join(components[2:], "/"))

	//log.Printf("JIRA issue: %v", issue)

	gr, err := http.NewRequest("POST", ghApiUrl, strings.NewReader(fmt.Sprintf(`{"event_type":"%s@%s"}`, issue.WebhookEvent, issue.Issue.Id)))

	if err != nil {
		http.Error(w, fmt.Sprintf("Fails to prepare GitHub request: %s", err.Error()), 500)

		return
	}

	gr.SetBasicAuth(values["user"][0], values["pass"][0])

	gr.Header.Add("Accept", "application/vnd.github.everest-preview+json")

	client := &http.Client{}
	gres, err := client.Do(gr)

	if err != nil {
		http.Error(w, fmt.Sprintf("Fails to send GitHub request: %s", err.Error()), 500)

		return
	}

	defer gres.Body.Close()

	w.WriteHeader(gres.StatusCode)

	rh := w.Header()

	for k, vs := range gres.Header {
		for _, v := range vs {
			rh.Add(k, v)
		}
	}

	io.Copy(w, gres.Body)

	log.Printf("Dispatch OK for %s", strings.Join(components[2:], "/"))
}
