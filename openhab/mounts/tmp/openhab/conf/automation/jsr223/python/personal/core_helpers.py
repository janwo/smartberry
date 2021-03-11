from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_helpers import remove_unlinked_helper_items, remove_invalid_helper_items


@rule("Core - Check helper items", description="Check helper items", tags=['core', 'helpers'])
@when("Item added")
@when("Item removed")
@when("Item updated")
def remove_unlinked_or_invalid_helper_items(event):
    remove_unlinked_helper_items()
    remove_invalid_helper_items()
