"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createCommunicationNote,
  type CommunicationNoteActionState,
} from "@/app/dashboard/communication-notes/actions";
import { SubmitButton } from "@/app/_frontend/components/forms/submit-button";

type CommunicationNoteFormProps = {
  customerId?: string;
  invoiceId?: string;
};

const initialState: CommunicationNoteActionState = {};

function FormMessage({ state }: { state: CommunicationNoteActionState }) {
  if (state.error) {
    return (
      <p className="rounded-[7px] border border-[#e24b4a]/30 bg-[#fcebeb] px-3 py-2 text-[11.5px] text-[#a32d2d]">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-[7px] border border-[#639922]/30 bg-[#eaf3de] px-3 py-2 text-[11.5px] text-[#3b6d11]">
        {state.success}
      </p>
    );
  }

  return null;
}

export function CommunicationNoteForm({
  customerId,
  invoiceId,
}: CommunicationNoteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(createCommunicationNote, initialState);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form action={action} className="grid gap-3.5" ref={formRef}>
      {customerId ? (
        <input name="customerId" type="hidden" value={customerId} />
      ) : null}
      {invoiceId ? (
        <input name="invoiceId" type="hidden" value={invoiceId} />
      ) : null}
      <FormMessage state={state} />
      <div className="grid gap-2.5 md:grid-cols-[180px_1fr]">
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Type
          <select
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            defaultValue="note"
            name="type"
          >
            <option value="note">General note</option>
            <option value="call">Call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="follow_up">Follow-up</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          Follow-up date
          <input
            className="h-[34px] rounded-[7px] border border-border bg-white px-2.5 text-[12px] text-foreground outline-none transition focus:border-accent"
            name="followUpAt"
            type="date"
          />
        </label>
      </div>
      <label className="grid gap-1.5 text-[11.5px] font-medium text-muted-foreground">
        Note
        <textarea
          className="min-h-24 rounded-[7px] border border-border bg-white px-2.5 py-2 text-[12px] text-foreground outline-none transition focus:border-accent"
          name="body"
          placeholder="Summarize the call, WhatsApp reply, email discussion, or next follow-up."
          required
        />
      </label>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Adding note...">Add note</SubmitButton>
      </div>
    </form>
  );
}
