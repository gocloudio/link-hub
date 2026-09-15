CREATE TABLE members (
    id uuid PRIMARY KEY,
    name text NOT NULL DEFAULT '',
    username text NOT NULL DEFAULT ''
);
ALTER TABLE cards ADD COLUMN is_private boolean NOT NULL DEFAULT false;
ALTER TABLE cards ADD COLUMN owner_id uuid;
ALTER TABLE cards ADD CONSTRAINT private_card_owner CHECK (NOT is_private OR owner_id IS NOT NULL);
CREATE INDEX cards_owner_idx ON cards(owner_id);
CREATE TABLE card_shares (
    card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id,user_id)
);
CREATE INDEX card_shares_user_idx ON card_shares(user_id,card_id);
