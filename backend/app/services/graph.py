"""Knowledge graph service - build and query knowledge graphs."""

from typing import List, Dict
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Entity, Relation, Document


class GraphService:
    """Build and manage knowledge graphs from extracted entities and relations."""

    @staticmethod
    async def get_graph_data(db: AsyncSession, kb_id: UUID) -> Dict:
        """Get full graph data (nodes + edges) for visualization."""
        # Get entities
        entities_result = await db.execute(
            select(Entity).where(Entity.kb_id == kb_id)
        )
        entities = entities_result.scalars().all()

        # Get relations
        relations_result = await db.execute(
            select(Relation).where(Relation.kb_id == kb_id)
        )
        relations = relations_result.scalars().all()

        # Build node list
        entity_id_map = {}
        nodes = []
        categories = list(set(e.type for e in entities))
        category_colors = {
            "退款诉求": "#f5222d",
            "投诉威胁": "#fa8c16",
            "专业人士进线": "#1677ff",
            "代家人进线": "#722ed1",
            "关联订单": "#13c2c2",
            "三方平台": "#52c41a",
            "非我司公司": "#eb2f96",
            "支付渠道": "#2f54eb",
            "解约解绑银行卡": "#fa541c",
            "多次主动询问保司": "#a0d911",
            "质问查不到扣费": "#faad14",
            "其他": "#8c8c8c",
        }

        for e in entities:
            node_id = str(e.id)
            entity_id_map[node_id] = e.name
            nodes.append({
                "id": node_id,
                "name": e.name,
                "type": e.type,
                "category": e.type,
                "symbolSize": min(20 + len(e.aliases) * 5, 60),
                "itemStyle": {"color": category_colors.get(e.type, "#ccc")},
                "aliases": e.aliases,
                "properties": e.properties,
            })

        # Build edge list
        edges = []
        for r in relations:
            source_id = str(r.source_entity_id)
            target_id = str(r.target_entity_id)
            if source_id in entity_id_map and target_id in entity_id_map:
                edges.append({
                    "source": source_id,
                    "target": target_id,
                    "label": r.relation_type,
                    "relation_type": r.relation_type,
                })

        return {
            "nodes": nodes,
            "edges": edges,
            "categories": [
                {"name": c, "itemStyle": {"color": category_colors.get(c, "#ccc")}}
                for c in categories
            ],
        }

    @staticmethod
    async def merge_entities(db: AsyncSession, kb_id: UUID, entities: List[Dict]) -> List[UUID]:
        """Insert or merge entities. Returns list of entity IDs."""
        entity_ids = []
        for e in entities:
            # Check if entity already exists (by name)
            result = await db.execute(
                select(Entity).where(
                    Entity.kb_id == kb_id,
                    Entity.name == e["name"],
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Merge: update aliases and properties
                if e.get("name") not in existing.aliases:
                    existing.aliases = list(set(existing.aliases or []))
                entity_ids.append(existing.id)
            else:
                new_entity = Entity(
                    kb_id=kb_id,
                    name=e["name"],
                    type=e.get("type", "concept"),
                    aliases=e.get("aliases", []),
                    properties=e.get("properties", {}),
                )
                db.add(new_entity)
                await db.flush()
                entity_ids.append(new_entity.id)

        return entity_ids

    @staticmethod
    async def save_relations(
        db: AsyncSession,
        kb_id: UUID,
        relations: List[Dict],
        entity_name_to_id: Dict[str, UUID],
        doc_id: UUID = None,
    ) -> int:
        """Save relations. Returns count of saved relations."""
        count = 0
        for r in relations:
            source_name = r.get("source")
            target_name = r.get("target")
            source_id = entity_name_to_id.get(source_name)
            target_id = entity_name_to_id.get(target_name)

            if not source_id or not target_id:
                continue

            # Check duplicate
            result = await db.execute(
                select(Relation).where(
                    Relation.kb_id == kb_id,
                    Relation.source_entity_id == source_id,
                    Relation.target_entity_id == target_id,
                    Relation.relation_type == r.get("relation", ""),
                )
            )
            if result.scalar_one_or_none():
                continue

            new_rel = Relation(
                kb_id=kb_id,
                source_entity_id=source_id,
                target_entity_id=target_id,
                relation_type=r.get("relation", "related_to"),
                properties=r.get("properties", {}),
                doc_id=doc_id,
            )
            db.add(new_rel)
            count += 1

        return count
