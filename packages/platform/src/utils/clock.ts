export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FrozenClock implements Clock {
  private current: Date;

  constructor(startAt: Date) {
    this.current = new Date(startAt.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advanceTo(target: Date): void {
    if (target.getTime() < this.current.getTime()) {
      throw new Error(`FrozenClock cannot move backwards from ${this.current.toISOString()}`);
    }

    this.current = new Date(target.getTime());
  }

  advanceBy(milliseconds: number): void {
    this.advanceTo(new Date(this.current.getTime() + milliseconds));
  }
}
