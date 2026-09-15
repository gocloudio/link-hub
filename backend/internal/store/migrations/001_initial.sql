CREATE TABLE categories (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 24 AND name = btrim(name)),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX categories_name_unique ON categories (lower(name));

CREATE TABLE cards (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80 AND name = btrim(name)),
    description_markdown text NOT NULL DEFAULT '' CHECK (char_length(description_markdown) <= 50000),
    url text NOT NULL CHECK (char_length(url) <= 2048 AND url ~ '^https?://'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX cards_created_at_idx ON cards (created_at DESC, id DESC);

CREATE TABLE card_categories (
    card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (card_id, category_id)
);
CREATE INDEX card_categories_category_idx ON card_categories (category_id, card_id);

-- 在事务提交时核验，允许同一事务先插入卡片、再添加分类，或整体替换分类关系。
CREATE FUNCTION ensure_card_has_category() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
    IF TG_TABLE_NAME = 'cards' THEN target := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN target := OLD.card_id;
    ELSE target := NEW.card_id;
    END IF;
    IF EXISTS (SELECT 1 FROM cards WHERE id = target)
       AND NOT EXISTS (SELECT 1 FROM card_categories WHERE card_id = target) THEN
        RAISE EXCEPTION 'card requires at least one category' USING ERRCODE = '23514', CONSTRAINT = 'card_requires_category';
    END IF;
    -- UPDATE 关联主键时也保护原卡片。
    IF TG_TABLE_NAME = 'card_categories' AND TG_OP = 'UPDATE' THEN
        IF OLD.card_id <> NEW.card_id AND EXISTS (SELECT 1 FROM cards WHERE id = OLD.card_id)
           AND NOT EXISTS (SELECT 1 FROM card_categories WHERE card_id = OLD.card_id) THEN
            RAISE EXCEPTION 'card requires at least one category' USING ERRCODE = '23514', CONSTRAINT = 'card_requires_category';
        END IF;
    END IF;
    RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER card_insert_category_check AFTER INSERT ON cards
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ensure_card_has_category();
CREATE CONSTRAINT TRIGGER card_link_category_check AFTER INSERT OR UPDATE OR DELETE ON card_categories
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ensure_card_has_category();

-- 单个工作空间的数据量很小；关联变更取得事务级锁，避免跨事务同时移除最后几个分类。
CREATE FUNCTION lock_card_category_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(71094621);
    RETURN NULL;
END;
$$;
CREATE TRIGGER card_category_write_lock BEFORE INSERT OR UPDATE OR DELETE ON card_categories
    FOR EACH STATEMENT EXECUTE FUNCTION lock_card_category_changes();
