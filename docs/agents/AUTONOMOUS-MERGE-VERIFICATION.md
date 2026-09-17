# Autonomous Merge Verification

The FLIXO auto-repair merge gate is responsible for the final merge action for `flixo-auto-repair/*` pull requests.

The gate must:

1. wait for all other pull-request checks to finish;
2. exclude only its own in-progress check from that wait;
3. require every other reported check to be passing;
4. re-read the live PR head and require an exact SHA match;
5. execute the merge with `--match-head-commit` against that exact SHA;
6. verify that the pull request is actually merged and that `main` has a live commit after the merge.

The gate must fail closed on head changes or non-green checks. It must never skip, weaken, or falsify a required check.
