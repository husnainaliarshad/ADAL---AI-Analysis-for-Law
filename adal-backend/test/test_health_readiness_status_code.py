import asyncio

from app.routes import health_router


class _HealthyDB:
    def execute(self, *_args, **_kwargs):
        return 1


class _FailingDB:
    def execute(self, *_args, **_kwargs):
        raise RuntimeError("db unavailable")


def test_health_readiness_returns_200_when_ready():
    response = asyncio.run(health_router.readiness_check(db=_HealthyDB()))
    assert response.status_code == 200


def test_health_readiness_returns_503_when_not_ready():
    response = asyncio.run(health_router.readiness_check(db=_FailingDB()))
    assert response.status_code == 503
