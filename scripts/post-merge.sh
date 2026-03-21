#!/bin/bash
set -e
npm install
echo "Skipping drizzle-kit push (interactive prompts cause timeout). Schema changes should be applied via direct SQL in task code."
