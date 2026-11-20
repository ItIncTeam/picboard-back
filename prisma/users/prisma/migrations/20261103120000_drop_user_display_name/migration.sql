-- displayName никогда не записывался и не читался: display name вычисляется в API-слое.
ALTER TABLE "User" DROP COLUMN "displayName";
