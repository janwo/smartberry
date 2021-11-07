from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_helpers import remove_unlinked_helper_items, remove_invalid_helper_items


@rule("Core - Check helper items", description="Check helper items", tags=['core', 'core-helpers'])
@when("Time cron 30 0/5 * ? * * *")
@when("System started")
def remove_unlinked_or_invalid_helper_items(event):
    remove_unlinked_helper_items()
    remove_invalid_helper_items()
