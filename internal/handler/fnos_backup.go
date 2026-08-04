package handler

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/fnosapi"
	"github.com/minibill/minibill/internal/i18n"
)

type fnosBackupDirView struct {
	Available    bool   `json:"available"`
	Configured   bool   `json:"configured"`
	Path         string `json:"path,omitempty"`
	SemanticPath string `json:"semantic_path,omitempty"`
}

type fnosBackupDirSyncReq struct {
	Path string `json:"path"`
}

func (s *Server) fnosBackupDirStatus(c *gin.Context) {
	view := s.buildFnosBackupDirView(localeFromHeader(c))
	c.JSON(http.StatusOK, view)
}

func (s *Server) fnosBackupDirSync(c *gin.Context) {
	if !fnosapi.Available() {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.fnos_unavailable"))
		return
	}
	var req fnosBackupDirSyncReq
	_ = c.ShouldBindJSON(&req)

	paths, err := fnosapi.GetSharedAccessibleFolders()
	if err != nil {
		JSONInternal(c, i18n.T(localeFromHeader(c), "error.fnos_shared_folders"))
		return
	}
	if len(paths) == 0 {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.fnos_no_shared_folder"))
		return
	}

	chosen := strings.TrimSpace(req.Path)
	if chosen == "" {
		chosen = paths[0]
	} else {
		ok := false
		for _, p := range paths {
			if filepath.Clean(p) == filepath.Clean(chosen) {
				chosen = p
				ok = true
				break
			}
		}
		if !ok {
			JSONValidation(c, i18n.T(localeFromHeader(c), "error.fnos_path_not_authorized"))
			return
		}
	}

	s.backupSvc.SetBackupDir(chosen)
	if err := fnosapi.PatchBackupDirEnv(s.cfg.DataDir, chosen); err != nil {
		JSONInternal(c, i18n.T(localeFromHeader(c), "error.fnos_env_patch"))
		return
	}
	if err := s.backupSvc.CheckDirWritable(); err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.fnos_dir_not_writable"))
		return
	}

	c.JSON(http.StatusOK, s.buildFnosBackupDirView(localeFromHeader(c)))
}

func (s *Server) buildFnosBackupDirView(locale string) fnosBackupDirView {
	path := s.backupSvc.DirPath()
	view := fnosBackupDirView{
		Available:  fnosapi.Available(),
		Configured: s.backupSvc.DirConfigured(),
		Path:       path,
	}
	if path != "" && fnosapi.Available() {
		lang := "zh-CN"
		if locale != "" {
			switch {
			case strings.HasPrefix(locale, "zh-Hant"), strings.HasPrefix(locale, "zh-TW"), strings.HasPrefix(locale, "zh-HK"):
				lang = "zh-TW"
			case strings.HasPrefix(locale, "zh"):
				lang = "zh-CN"
			case strings.HasPrefix(locale, "en"):
				lang = "en-US"
			default:
				lang = locale
			}
		}
		if m, err := fnosapi.ConvertPath([]string{path}, lang); err == nil {
			if sem := m[path]; sem != "" {
				view.SemanticPath = sem
			}
		}
	}
	return view
}
