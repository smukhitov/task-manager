import uuid
from datetime import UTC, datetime
from typing import Any

from sqlmodel import Session, col, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    Item,
    ItemCreate,
    ItemStatus,
    SortDirection,
    User,
    UserCreate,
    UserUpdate,
)


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


# Dummy hash to use for timing attack prevention when user is not found
# This is an Argon2 hash of a random password, used to ensure constant-time comparison
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        # Prevent timing attacks by running password verification even when user doesn't exist
        # This ensures the response time is similar whether or not the email exists
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_password_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        return None
    if updated_password_hash:
        db_user.hashed_password = updated_password_hash
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
    return db_user


def get_column_items(
    *, session: Session, owner_id: uuid.UUID, status: ItemStatus
) -> list[Item]:
    """Return one board column, ordered by `position`."""
    statement = (
        select(Item)
        .where(Item.owner_id == owner_id, Item.status == status)
        .order_by(col(Item.position), col(Item.id))
    )
    return list(session.exec(statement).all())


def _renumber(items: list[Item], session: Session) -> None:
    """Assign contiguous 0-based positions in list order."""
    for index, item in enumerate(items):
        item.position = index
        session.add(item)


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    trailing_position = len(
        get_column_items(session=session, owner_id=owner_id, status=ItemStatus.todo)
    )
    db_item = Item.model_validate(
        item_in,
        update={
            "owner_id": owner_id,
            "status": ItemStatus.todo,
            "position": trailing_position,
        },
    )
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


def move_item(
    *,
    session: Session,
    item: Item,
    target_status: ItemStatus,
    target_index: int,
) -> Item:
    """
    Move `item` to `target_index` of the `target_status` column.

    Leaves every affected column contiguous from 0, in a single transaction.
    """
    source_status = item.status
    owner_id = item.owner_id

    if source_status != target_status:
        source_column = [
            other
            for other in get_column_items(
                session=session, owner_id=owner_id, status=source_status
            )
            if other.id != item.id
        ]
        _renumber(source_column, session)
        item.status = target_status

    target_column = [
        other
        for other in get_column_items(
            session=session, owner_id=owner_id, status=target_status
        )
        if other.id != item.id
    ]
    target_column.insert(min(target_index, len(target_column)), item)
    _renumber(target_column, session)

    session.commit()
    session.refresh(item)
    return item


def sort_column(
    *,
    session: Session,
    owner_id: uuid.UUID,
    status: ItemStatus,
    direction: SortDirection,
) -> list[Item]:
    """Renumber a whole `(owner, status)` column `0..n-1` by `created_at`."""
    items = get_column_items(session=session, owner_id=owner_id, status=status)
    items.sort(
        key=lambda item: (item.created_at or datetime.min.replace(tzinfo=UTC), item.id),
        reverse=direction == SortDirection.newest_first,
    )
    _renumber(items, session)
    session.commit()
    for item in items:
        session.refresh(item)
    return items
