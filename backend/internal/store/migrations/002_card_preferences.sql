CREATE TABLE user_card_preferences (
    user_id uuid NOT NULL,
    card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    favorite boolean NOT NULL DEFAULT false,
    position integer CHECK (position >= 0),
    PRIMARY KEY (user_id, card_id)
);
CREATE INDEX user_card_preferences_card_idx ON user_card_preferences (card_id);
