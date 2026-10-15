"""
Conformance suite for the Integration Response contract v1.0.

    pip install jsonschema
    python validate.py

Every example must validate; every case in REJECTED must fail.
Exit code 0 only when both hold.
"""
import copy
import json
import pathlib
import sys

from jsonschema import Draft202012Validator, FormatChecker

HERE = pathlib.Path(__file__).parent
SCHEMA = json.loads((HERE / "integration-response.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())

ACCEPTED = json.loads((HERE / "examples" / "accepted.example.json").read_text(encoding="utf-8"))


def variant(**changes):
    doc = copy.deepcopy(ACCEPTED)
    for key, value in changes.items():
        if value is ...:
            doc.pop(key, None)
        else:
            doc[key] = value
    return doc


REJECTED = {
    "missing correlationId": variant(correlationId=...),
    "correlationId not a uuid": variant(correlationId="12345"),
    "acknowledgement without result": variant(result=...),
    "unknown result": variant(result="MAYBE"),
    "unknown response type": variant(responseType="RECEIPT"),
    "rejection without reason": variant(result="REJECTED", message="No."),
    "rejection without message": variant(result="REJECTED", reasonCode="UNKNOWN_ITEM"),
    "accepted with changes but no changes": variant(result="ACCEPTED_WITH_CHANGES"),
    "accepted with changes, empty list": variant(result="ACCEPTED_WITH_CHANGES", changes=[]),
    "exception without reason": variant(responseType="EXCEPTION", result=..., message="Late."),
    "lower-case reason code": variant(result="REJECTED", reasonCode="unknown_item", message="x"),
    "unknown field": variant(orderId="ORD-1"),
    "wrong schema version": variant(schemaVersion="2.0"),
    "bad timestamp": variant(respondedAt="yesterday"),
}


def main():
    failures = 0

    for path in sorted((HERE / "examples").glob("*.json")):
        errors = list(VALIDATOR.iter_errors(json.loads(path.read_text(encoding="utf-8"))))
        if errors:
            failures += 1
            print(f"FAIL  example {path.name}: {errors[0].message}")
        else:
            print(f"ok    example {path.name}")

    for name, doc in REJECTED.items():
        if VALIDATOR.is_valid(doc):
            failures += 1
            print(f"FAIL  should be rejected: {name}")
        else:
            print(f"ok    rejected: {name}")

    total = len(list((HERE / "examples").glob("*.json"))) + len(REJECTED)
    print(f"\n{total - failures}/{total} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
