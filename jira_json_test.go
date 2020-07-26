package main

import (
	"encoding/json"
	"testing"
	"github.com/google/go-cmp/cmp"
)

func TestUnmarshalJiraIssueCallback(t *testing.T) {
	input := `{
    "timestamp": 123456789,
    "webhookEvent": "foo",
    "issue": {
      "id": "i"
    }
  }`

	expected := JiraIssueCallbackPayload {
		Timestamp: 123456789,
		WebhookEvent: "foo",
		Issue: JiraIssueCallbackRef {
			Id: "i",
		},
	}

	var got JiraIssueCallbackPayload
	err := json.Unmarshal([]byte(input), &got)

	if err != nil {
		t.Error(err)
	}

	if !cmp.Equal(got, expected) {
		t.Errorf("%v != %v\n%s", got, expected, cmp.Diff(got, expected))
	}
}
