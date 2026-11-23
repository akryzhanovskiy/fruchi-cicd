"""One-shot maintenance commands: `python -m app.cli <command>`."""

import argparse
import asyncio
import getpass
import sys
from collections.abc import Callable

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.services.seed import seed
from app.services.storage import init_bucket
from app.services.users import ensure_admin, set_password

MIN_PASSWORD_LENGTH = 8


def set_password_interactive(email: str) -> None:
    """Asks for the new password twice (not echoed, not in shell history)."""
    password = getpass.getpass("Новий пароль: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        sys.exit(f"Пароль має містити щонайменше {MIN_PASSWORD_LENGTH} символів")
    if getpass.getpass("Повторіть пароль: ") != password:
        sys.exit("Паролі не збігаються")
    if not asyncio.run(set_password(email, password)):
        sys.exit(f"Користувача {email} не знайдено")
    print(f"Пароль для {email} змінено")


COMMANDS: dict[str, Callable[[argparse.Namespace], None]] = {
    "init-storage": lambda _: init_bucket(),
    "seed": lambda _: asyncio.run(seed()),
    "ensure-admin": lambda _: asyncio.run(ensure_admin()),
    "set-password": lambda args: set_password_interactive(
        args.email or get_settings().admin_initial_email
    ),
}


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    parser.add_argument("command", choices=COMMANDS)
    parser.add_argument("email", nargs="?", help="set-password: user email (default: first admin)")
    args = parser.parse_args()
    setup_logging(get_settings().log_level)
    COMMANDS[args.command](args)


if __name__ == "__main__":
    main()
