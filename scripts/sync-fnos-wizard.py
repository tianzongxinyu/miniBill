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
    # 每项独立 step，飞牛应用设置编辑弹窗会竖向排布（同 step 内多字段会并排）。
    # stepTitle 作分区标题；label 仅放补充说明，避免与 stepTitle 重复显示。
    payload = [
        {
            "stepTitle": "服务端口",
            "items": [
                {
                    "type": "text",
                    "field": "wizard_port",
                    "label": "应用监听端口",
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
                    "label": "绝对路径，留空表示不启用备份",
                    "initValue": "",
                }
            ],
        },
        {
            "stepTitle": "是否开放注册",
            "items": [
                {
                    "type": "radio",
                    "field": "wizard_allow_registration",
                    "label": "关闭后不可自助注册",
                    "initValue": "true",
                    "options": [
                        {"label": "开放", "value": "true"},
                        {"label": "关闭", "value": "false"},
                    ],
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
