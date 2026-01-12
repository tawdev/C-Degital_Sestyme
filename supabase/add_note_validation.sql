-- Add 'validated_at' column to project_notes
ALTER TABLE public.project_notes 
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ DEFAULT NULL;

-- Create policy to blocking Update/Delete on validated notes?
-- Actually, it's better to enforce this logic in the application layer (Server Actions) 
-- OR via a Trigger to allow the Project Owner to set the validation but block others.

-- Let's create a trigger to prevent modification of validated notes.
CREATE OR REPLACE FUNCTION prevent_modification_of_validated_notes()
RETURNS TRIGGER AS $$
BEGIN
    -- If the note was already validated (OLD.validated_at IS NOT NULL)
    -- And we are trying to change something other than 'validated_at' (in case we want to un-validate, though requirement says 'verrouillage')
    -- For now, strict lock: If it's validated, it's immutable.
    
    -- Exception: The validation action itself sets validated_at.
    -- So we allow UPDATE if OLD.validated_at IS NULL.
    
    IF OLD.validated_at IS NOT NULL THEN
       RAISE EXCEPTION 'Cannot modify or delete a validated journal entry.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_note_validation_update ON project_notes;
CREATE TRIGGER check_note_validation_update
BEFORE UPDATE OR DELETE ON project_notes
FOR EACH ROW
EXECUTE FUNCTION prevent_modification_of_validated_notes();
