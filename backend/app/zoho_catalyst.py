"""
Zoho Catalyst integration point.

This prototype runs on local SQLite so it works with zero external accounts
during the datathon demo. This module is the single place to plug in Zoho
Catalyst's Data Store as the shared backing database once you have a project
provisioned. Nothing else in the codebase needs to change -- `database.py`
already reads `DATABASE_URL` from the environment, and SQLAlchemy's ORM
layer in models.py is database-agnostic.

Two ways to actually wire Catalyst in, depending on what you want:

OPTION A — Catalyst as a Postgres/MySQL-compatible SQL data source
    If your Catalyst project's Data Store is exposed as a standard SQL
    endpoint, this is the path of least resistance:

        export DATABASE_URL="postgresql://<user>:<password>@<catalyst-host>:<port>/<db>"

    Then just run the app normally -- `database.py` picks it up automatically
    and every existing endpoint, model, and query works unchanged.

OPTION B — Catalyst Data Store via its REST API (ZCQL)
    If you want to call Catalyst's REST/ZCQL API directly instead of a raw
    SQL connection, implement the two functions below using Catalyst's SDK
    or `requests` against its REST endpoints, and swap the calls in
    `database.py`'s `get_db()` to use this module instead of SQLAlchemy's
    session. This is more work but avoids exposing a raw DB port.

Required from you before either path works:
    - CATALYST_PROJECT_ID
    - CATALYST_ORG_ID
    - An OAuth token (Catalyst uses Zoho's standard OAuth2 flow) or the
      Data Store's direct SQL credentials, depending on which option above.

Fill in `CATALYST_PROJECT_ID` / `CATALYST_AUTH_TOKEN` below once you have
them, and flip `USE_CATALYST = True`.
"""
import os

USE_CATALYST = False
CATALYST_PROJECT_ID = os.environ.get("CATALYST_PROJECT_ID", "")
CATALYST_ORG_ID = os.environ.get("CATALYST_ORG_ID", "")
CATALYST_AUTH_TOKEN = os.environ.get("CATALYST_AUTH_TOKEN", "")


def catalyst_configured() -> bool:
    return bool(USE_CATALYST and CATALYST_PROJECT_ID and CATALYST_AUTH_TOKEN)


def zcql_query(query: str):
    """
    Placeholder for a ZCQL (Zoho Catalyst Query Language) call, e.g.:

        import requests
        resp = requests.post(
            f"https://api.catalyst.zoho.com/baas/v1/project/{CATALYST_PROJECT_ID}/zcql",
            headers={"Authorization": f"Zoho-oauthtoken {CATALYST_AUTH_TOKEN}"},
            json={"query": query},
        )
        return resp.json()

    Left unimplemented until real project credentials are available --
    calling this today raises clearly instead of failing silently.
    """
    raise NotImplementedError(
        "Zoho Catalyst credentials are not configured. Set CATALYST_PROJECT_ID, "
        "CATALYST_ORG_ID, and CATALYST_AUTH_TOKEN as environment variables, or use "
        "OPTION A (DATABASE_URL) in this module's docstring instead."
    )
