using System.Collections.Generic;

namespace Suwol.AtlasMaker.Editor
{
    public sealed class SuwolAtlasValidationReport
    {
        private readonly List<string> errors = new List<string>();
        private readonly List<string> warnings = new List<string>();
        private readonly List<string> infos = new List<string>();

        public IList<string> Errors
        {
            get { return errors; }
        }

        public IList<string> Warnings
        {
            get { return warnings; }
        }

        public IList<string> Infos
        {
            get { return infos; }
        }

        public bool IsValid
        {
            get { return errors.Count == 0; }
        }

        public void AddError(string message)
        {
            errors.Add(message);
        }

        public void AddWarning(string message)
        {
            warnings.Add(message);
        }

        public void AddInfo(string message)
        {
            infos.Add(message);
        }
    }
}
