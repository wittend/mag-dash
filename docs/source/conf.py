# SPDX-License-Identifier: GPL-3.0-or-later
import os
import sys
from datetime import datetime

project = 'mag-dash'
author = 'hamsci-mon contributors'
copyright = f"{datetime.now():%Y}, {author}"

extensions = [
    'myst_parser',
    'sphinx_copybutton',
]

templates_path = ['_templates']
exclude_patterns = ['_build']

html_theme = 'furo'
html_title = project
html_static_path = ['_static']

# MyST configuration
myst_enable_extensions = [
    'colon_fence',
    'substitution',
]

source_suffix = {
    '.md': 'markdown',
    '.rst': 'restructuredtext',
}
