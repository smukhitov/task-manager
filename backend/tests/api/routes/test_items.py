import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.item import create_random_item
from tests.utils.user import create_random_user_with_token


def test_create_item(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Foo", "description": "Fighters"}
    response = client.post(
        f"{settings.API_V1_STR}/items/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["description"] == data["description"]
    assert "id" in content
    assert "owner_id" in content


def test_read_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.get(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == item.title
    assert content["description"] == item.description
    assert content["id"] == str(item.id)
    assert content["owner_id"] == str(item.owner_id)


def test_read_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Item not found"


def test_read_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.get(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"


def test_read_items(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_item(db)
    create_random_item(db)
    response = client.get(
        f"{settings.API_V1_STR}/items/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 2


def test_update_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["description"] == data["description"]
    assert content["id"] == str(item.id)
    assert content["owner_id"] == str(item.owner_id)


def test_update_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Item not found"


def test_update_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    data = {"title": "Updated title", "description": "Updated description"}
    response = client.put(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=normal_user_token_headers,
        json=data,
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"


def test_delete_item(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.delete(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Item deleted successfully"


def test_delete_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_V1_STR}/items/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Item not found"


def test_delete_item_not_enough_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    item = create_random_item(db)
    response = client.delete(
        f"{settings.API_V1_STR}/items/{item.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"


def create_items(
    client: TestClient, headers: dict[str, str], count: int
) -> list[dict[str, Any]]:
    """Create `count` items through the API and return them in creation order."""
    items = []
    for index in range(count):
        response = client.post(
            f"{settings.API_V1_STR}/items/",
            headers=headers,
            json={"title": f"Item {index}"},
        )
        assert response.status_code == 200
        items.append(response.json())
    return items


def read_column(
    client: TestClient, headers: dict[str, str], status: str
) -> list[dict[str, Any]]:
    """Return one column of the caller's items, ordered by position."""
    response = client.get(f"{settings.API_V1_STR}/items/", headers=headers)
    assert response.status_code == 200
    column = [item for item in response.json()["data"] if item["status"] == status]
    return sorted(column, key=lambda item: item["position"])


def test_create_item_defaults_to_todo_with_trailing_position(
    client: TestClient, db: Session
) -> None:
    _, headers = create_random_user_with_token(client=client, db=db)

    created = create_items(client, headers, 3)

    assert [item["status"] for item in created] == ["todo", "todo", "todo"]
    assert [item["position"] for item in created] == [0, 1, 2]


def test_move_item_within_column(client: TestClient, db: Session) -> None:
    _, headers = create_random_user_with_token(client=client, db=db)
    first, second, third = create_items(client, headers, 3)

    response = client.post(
        f"{settings.API_V1_STR}/items/{third['id']}/move",
        headers=headers,
        json={"target_status": "todo", "target_index": 0},
    )

    assert response.status_code == 200
    assert response.json()["position"] == 0
    column = read_column(client, headers, "todo")
    assert [item["id"] for item in column] == [third["id"], first["id"], second["id"]]
    assert [item["position"] for item in column] == [0, 1, 2]


def test_move_item_across_columns(client: TestClient, db: Session) -> None:
    _, headers = create_random_user_with_token(client=client, db=db)
    first, second, third = create_items(client, headers, 3)

    response = client.post(
        f"{settings.API_V1_STR}/items/{second['id']}/move",
        headers=headers,
        json={"target_status": "in_progress", "target_index": 0},
    )

    assert response.status_code == 200
    content = response.json()
    assert content["status"] == "in_progress"
    assert content["position"] == 0

    todo = read_column(client, headers, "todo")
    assert [item["id"] for item in todo] == [first["id"], third["id"]]
    assert [item["position"] for item in todo] == [0, 1]

    in_progress = read_column(client, headers, "in_progress")
    assert [item["id"] for item in in_progress] == [second["id"]]
    assert [item["position"] for item in in_progress] == [0]


def test_move_item_to_any_status(client: TestClient, db: Session) -> None:
    _, headers = create_random_user_with_token(client=client, db=db)
    (item,) = create_items(client, headers, 1)

    response = client.post(
        f"{settings.API_V1_STR}/items/{item['id']}/move",
        headers=headers,
        json={"target_status": "completed", "target_index": 0},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_move_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/items/{uuid.uuid4()}/move",
        headers=superuser_token_headers,
        json={"target_status": "todo", "target_index": 0},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Item not found"


def test_move_item_not_enough_permissions(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    item = create_random_item(db)
    payload = {"target_status": "in_progress", "target_index": 0}

    for headers in (normal_user_token_headers, superuser_token_headers):
        response = client.post(
            f"{settings.API_V1_STR}/items/{item.id}/move",
            headers=headers,
            json=payload,
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not enough permissions"


def test_sort_column_by_created_at(client: TestClient, db: Session) -> None:
    user, headers = create_random_user_with_token(client=client, db=db)
    assert user.id is not None
    now = datetime.now(UTC)
    items = [create_random_item(db, owner_id=user.id) for _ in range(3)]
    for offset, item in enumerate(items):
        item.created_at = now + timedelta(minutes=offset)
        db.add(item)
    db.commit()
    oldest, middle, newest = items

    response = client.post(
        f"{settings.API_V1_STR}/items/sort",
        headers=headers,
        json={"status": "todo", "direction": "newest_first"},
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["data"]] == [
        str(newest.id),
        str(middle.id),
        str(oldest.id),
    ]
    column = read_column(client, headers, "todo")
    assert [item["id"] for item in column] == [
        str(newest.id),
        str(middle.id),
        str(oldest.id),
    ]
    assert [item["position"] for item in column] == [0, 1, 2]

    response = client.post(
        f"{settings.API_V1_STR}/items/sort",
        headers=headers,
        json={"status": "todo", "direction": "oldest_first"},
    )
    assert response.status_code == 200
    column = read_column(client, headers, "todo")
    assert [item["id"] for item in column] == [
        str(oldest.id),
        str(middle.id),
        str(newest.id),
    ]
    assert [item["position"] for item in column] == [0, 1, 2]


def test_sort_only_touches_own_items(client: TestClient, db: Session) -> None:
    _, headers = create_random_user_with_token(client=client, db=db)
    other_item = create_random_item(db)

    response = client.post(
        f"{settings.API_V1_STR}/items/sort",
        headers=headers,
        json={"status": "todo", "direction": "newest_first"},
    )

    assert response.status_code == 200
    assert other_item.id not in {
        uuid.UUID(item["id"]) for item in response.json()["data"]
    }
