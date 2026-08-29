import uuid

from sqlmodel import Session

from app import crud
from app.models import Item, ItemCreate
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def create_random_item(db: Session, owner_id: uuid.UUID | None = None) -> Item:
    """Create an item, owned by a fresh random user unless `owner_id` is given."""
    if owner_id is None:
        owner_id = create_random_user(db).id
    assert owner_id is not None
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    return crud.create_item(session=db, item_in=item_in, owner_id=owner_id)
