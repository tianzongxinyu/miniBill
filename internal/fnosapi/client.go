package fnosapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	trimSocketPath = "/var/run/trim_open_gateway_apiscope.socket"
	trimAPIPath    = "/api/v1/trimapp"
	defaultAppName = "minibill"
)

// Available reports whether TRIM_API_TOKEN is set (fnOS app runtime).
func Available() bool {
	return strings.TrimSpace(os.Getenv("TRIM_API_TOKEN")) != ""
}

func appName() string {
	if v := strings.TrimSpace(os.Getenv("TRIM_APPNAME")); v != "" {
		return v
	}
	return defaultAppName
}

type rpcRequest struct {
	ReqID   string `json:"reqId"`
	Req     string `json:"req"`
	AppName string `json:"appName"`
	Data    any    `json:"data"`
}

type rpcResponse struct {
	ReqID string          `json:"reqId"`
	Code  int             `json:"code"`
	Msg   string          `json:"msg"`
	Data  json.RawMessage `json:"data"`
}

func call(reqName string, data any, out any) error {
	token := strings.TrimSpace(os.Getenv("TRIM_API_TOKEN"))
	if token == "" {
		return fmt.Errorf("TRIM_API_TOKEN not set")
	}
	body, err := json.Marshal(rpcRequest{
		ReqID:   fmt.Sprintf("%d", time.Now().UnixNano()),
		Req:     reqName,
		AppName: appName(),
		Data:    data,
	})
	if err != nil {
		return err
	}

	transport := &http.Transport{
		Dial: func(_, _ string) (net.Conn, error) {
			return net.Dial("unix", trimSocketPath)
		},
	}
	client := &http.Client{Transport: transport, Timeout: 15 * time.Second}
	httpReq, err := http.NewRequest(http.MethodPost, "http://localhost"+trimAPIPath, bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("trim api http %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	var rpc rpcResponse
	if err := json.Unmarshal(raw, &rpc); err != nil {
		return err
	}
	if rpc.Code != 0 {
		msg := rpc.Msg
		if msg == "" {
			msg = "trim api error"
		}
		return fmt.Errorf("%s (code %d)", msg, rpc.Code)
	}
	if out == nil || len(rpc.Data) == 0 || string(rpc.Data) == "null" {
		return nil
	}
	return json.Unmarshal(rpc.Data, out)
}

type convertPathResultItem struct {
	Path         string `json:"path"`
	SemanticPath string `json:"semanticPath"`
}

type convertPathData struct {
	Status int                     `json:"status"`
	Result []convertPathResultItem `json:"result"`
}

// ConvertPath maps internal /vol paths to user-facing semantic paths.
func ConvertPath(paths []string, language string) (map[string]string, error) {
	if language == "" {
		language = "zh-CN"
	}
	var data convertPathData
	if err := call("trim.file.convertPath", map[string]any{
		"path":     paths,
		"language": language,
	}, &data); err != nil {
		return nil, err
	}
	out := make(map[string]string, len(data.Result))
	for _, item := range data.Result {
		if item.Path == "" {
			continue
		}
		out[item.Path] = item.SemanticPath
	}
	return out, nil
}
