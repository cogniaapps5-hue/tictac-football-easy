# Roadmap

- [x] Reproduce the admin enrollment failure with the real authenticated flow
- [x] Harden client/server validation, diagnostics, and exact error feedback
- [x] Add a temporary safe create/delete enrollment test
- [x] Verify live database grants and RLS for enrollment tables
- [x] Run the real create/delete test and browser-console verification
- [x] Present results before publishing
- [x] Fix and verify the manual enrollment admin credential flow
- [x] Read privileged keys from the production server runtime bindings
- [x] Verify a real admin enrollment and remove the temporary test account
- [x] Move the privileged credential read into the server-function handler
- [x] Replace dynamic secret lookup with a direct request-handler runtime read
- [x] Read Nitro production bindings from its request-scoped global environment
- [ ] Publish and verify the corrected production enrollment secret binding
