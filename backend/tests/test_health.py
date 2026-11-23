from app.services import health


async def test_healthz(client):
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readyz_ok(client, monkeypatch):
    async def ok():
        return {"database": True, "storage": True}

    monkeypatch.setattr(health, "readiness", ok)
    response = await client.get("/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_readyz_unavailable(client, monkeypatch):
    async def db_down():
        return {"database": False, "storage": True}

    monkeypatch.setattr(health, "readiness", db_down)
    response = await client.get("/readyz")
    assert response.status_code == 503
    assert response.json()["checks"]["database"] is False


def test_public_read_policy_targets_bucket_objects():
    import json

    from app.services.storage import public_read_policy

    statement = json.loads(public_read_policy("media"))["Statement"][0]
    assert statement["Action"] == ["s3:GetObject"]
    assert statement["Resource"] == ["arn:aws:s3:::media/*"]
