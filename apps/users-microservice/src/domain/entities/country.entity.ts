export class CountryEntity {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly nameRu: string | null,
  ) {}
}
