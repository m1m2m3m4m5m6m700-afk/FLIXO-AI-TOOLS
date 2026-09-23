# Master Repair 20X Trust Contract

The default state is UNTRUSTED. Master Repair cannot grant trust, GREEN, certification, or publication authority to itself.

The trust path is:

Failure → RCA → Patch Truth → Candidate → Independent Rebuild → Adversarial → Independent Verifier → Negative Proof → Historical Replay → Rollback → Canary → 2-of-3 Authority → Platform Enforcement → Publication.

Authority is separated:

- Master Repair: bounded mutation/proposal only.
- Independent Diagnoser: read-only diagnosis.
- Patch Truth Engine: re-derives Git diff; agent patch text is not evidence.
- Adversarial Falsifier: attempts to invalidate the repair.
- Independent Verifier: checks the candidate.
- Chair-1: publication authorization.
- Canonical CI: GREEN evidence authority.
- Certification: attestation authority.
- GitHub platform: final enforcement boundary.

Every evidence-bearing object is bound to exact SHA and freshness metadata. Any SHA/environment/identity drift returns UNTRUSTED.

The Governor builds a cryptographic chain from Failure through Chair. The chain root is a receipt, not a GREEN certificate.

The 2-of-3 reducer requires two distinct authority actors and requires Chair-1 before publication.

Positive learning promotion remains impossible before Canonical GREEN and independent certification.

The repository platform protection is external state. The source tree cannot self-grant it; the Governor therefore fails closed when GitHub Rulesets/branch protection are absent.
