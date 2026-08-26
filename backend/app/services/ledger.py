import hashlib
import json
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import AuditLedger


def _hash_payload(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def record_event(db: Session, record_type: str, record_id: int, action: str,
                  actor_id: int, payload: dict) -> AuditLedger:
    """Appends a tamper-evident event. Each block hashes in the previous
    block's hash, so any historical edit breaks the chain — the same
    guarantee the README describes as the 'blockchain security ledger',
    implemented here as a verifiable hash chain rather than a separate
    blockchain network."""
    last = db.query(AuditLedger).order_by(AuditLedger.id.desc()).first()
    prev_hash = last.block_hash if last else ""
    data_hash = _hash_payload(payload)
    timestamp = datetime.utcnow()
    block_hash = AuditLedger.compute_block_hash(
        record_type, record_id, action, actor_id, data_hash, prev_hash, timestamp
    )
    entry = AuditLedger(
        record_type=record_type, record_id=record_id, action=action,
        actor_id=actor_id, data_hash=data_hash, prev_block_hash=prev_hash,
        block_hash=block_hash, timestamp=timestamp,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def verify_chain(db: Session) -> bool:
    """Walks the whole ledger and recomputes each block hash to confirm
    nothing has been altered."""
    entries = db.query(AuditLedger).order_by(AuditLedger.id.asc()).all()
    prev_hash = ""
    for e in entries:
        expected = AuditLedger.compute_block_hash(
            e.record_type, e.record_id, e.action, e.actor_id,
            e.data_hash, prev_hash, e.timestamp,
        )
        if expected != e.block_hash or e.prev_block_hash != prev_hash:
            return False
        prev_hash = e.block_hash
    return True
