# Tests Directory

Unit, integration, and end-to-end tests:

- unit/ - Individual component tests
- integration/ - API and service tests  
- e2e/ - Full user journey tests

Run tests with: pytest tests/
"@ | Out-File -FilePath "tests/README.md" -Encoding utf8

@"
# Scripts Directory

Utility scripts for:
- Deployment automation
- Database backups
- Data processing
- Model training

Use scripts/deploy/deploy.sh for production deployment.
