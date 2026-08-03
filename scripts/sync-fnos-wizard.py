#!/usr/bin/env python3
"""Sync fnos/wizard/config (UTF-8). Used by build-fpk.sh / build-fpk.ps1."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def main() -> int:
    root = Path(os.environ.get("FNOS_DIR") or Path(__file__).resolve().parent.parent / "fnos")
    config_path = root / "wizard" / "config"
    # 每项独立 step，飞牛应用设置编辑弹窗会竖向排布（同 step 内多字段会并排）
    payload = [
        {
            "stepTitle": "服务端口",
            "items": [
                {
                    "type": "text",
                    "field": "wizard_port",
                    "label": "服务端口",
                    "initValue": "18080",
                }
            ],
        },
        {
            "stepTitle": "备份目录",
            "items": [
                {
                    "type": "text",
                    "field": "wizard_backup_dir",
                    "label": "备份目录（绝对路径，留空表示不启用备份）",
                    "initValue": "",
                }
            ],
        },
        {
            "stepTitle": "用户注册",
            "items": [
                {
                    "type": "text",
                    "field": "wizard_allow_registration",
                    "label": "开放用户注册（true/false；false=关闭，无用户时仍可注册首位管理员）",
                    "initValue": "true",
                }
            ],
        },
    ]
    config_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=4) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
