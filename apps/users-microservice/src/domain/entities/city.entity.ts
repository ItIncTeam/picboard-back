export class CityEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly nameRu: string | null,
    public readonly countryId: string,
    public readonly population: number | null,
  ) {}
}
