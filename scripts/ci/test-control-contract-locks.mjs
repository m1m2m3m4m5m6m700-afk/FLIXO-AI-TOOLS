#!/usr/bin/env node
import {execFileSync} from 'node:child_process'; execFileSync(process.execPath,['scripts/ci/validate-control-contract-locks.mjs'],{stdio:'inherit'}); console.log('CONTROL_CONTRACT_LOCKS_TEST=PASS');
